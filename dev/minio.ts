import { Pod, Service, PersistentVolumeClaim, Secret } from "@pulumi/kubernetes/core/v1";
import { Config } from "@pulumi/pulumi";
import {execSync} from "child_process";
import {readFileSync, unlinkSync} from "fs";

export default () => {
    const config = new Config
    const minio = config.requireObject<{
        image: string
        tag: string
    }>("minio");

    const data: PersistentVolumeClaim = new PersistentVolumeClaim('minio', {
        metadata: {
            name: "minio",
            annotations: { "pulumi.com/skipAwait": "true" }
        },
        spec: {
            accessModes: ["ReadWriteOnce"],
            storageClassName: "local-path",
            resources: {
                requests: {
                    storage: "50Gi"
                }
            }
        }
    }, {
        retainOnDelete: true
    });

    execSync(`mkcert -cert-file tls.crt -key-file tls.key 127.0.0.1 ::1 localhost "minio.svc.cluster.local" "minio.default.svc.cluster.local"`)

    const tls: Secret = new Secret("minio.tls", {
        metadata: {
            name: "minio.tls"
        },
        type: "tls",
        data: {
            "tls.crt": readFileSync('tls.crt', 'base64'),
            "tls.key": readFileSync('tls.key', 'base64')
        }
    });

    unlinkSync('tls.crt')
    unlinkSync('tls.key')

    const pod = new Pod('minio', {
        metadata: {
            name: "minio",
            labels: {
                "app.kubernetes.io/name": "minio",
                "version": minio.tag
            },
            annotations: {
                "kubectl.kubernetes.io/default-container": "minio",
                "pulumi.com/patchForce": "true"
            }
        },
        spec: {
            os: { name: "linux" },
            volumes: [
                {
                    name: "data",
                    persistentVolumeClaim: { claimName: data.metadata.name }
                },
                {
                    name: "tls",
                    secret: { secretName: tls.metadata.name }
                }
            ],
            containers: [{
                name: "minio",
                image: minio.image + ":" + minio.tag,
                imagePullPolicy: "IfNotPresent",
                args: ["server", "/data", "--address", ":443", "--console-address", ":8443"],
                ports: [
                    {
                        name: "api",
                        containerPort: 443
                    },
                    {
                        name: "console",
                        containerPort: 8443
                    }
                ],
                volumeMounts: [
                    {
                        name: "data",
                        mountPath: "/data"
                    },
                    {
                        name: "tls",
                        mountPath: "/root/.minio/certs/private.key",
                        subPath: "tls.key",
                        readOnly: true
                    },
                    {
                        name: "tls",
                        mountPath: "/root/.minio/certs/public.crt",
                        subPath: "tls.crt",
                        readOnly: true
                    }
                ]
            }]
        }
    }, {
        dependsOn: [data, tls]
    })

    const service = new Service("minio", {
        metadata: { name: "minio" },
        spec: {
            selector: { "app.kubernetes.io/name": "minio" },
            ports: [
                {
                    name: "api",
                    port: 443,
                    targetPort: 443
                },
                {
                    name: "console",
                    port: 8443,
                    targetPort: 8443
                }
            ]
        }
    }, {
        dependsOn: pod,
        parent: pod
    });

    return {
        data: data.status,
        pod: pod.status,
        service: service.status
    }
}