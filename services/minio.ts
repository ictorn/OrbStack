import { Pod, Service, PersistentVolumeClaim } from "@pulumi/kubernetes/core/v1";
import { Config } from "@pulumi/pulumi";
import { Ingress } from "@pulumi/kubernetes/networking/v1";
import {Chart} from "@pulumi/kubernetes/helm/v3";

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

const pod = new Pod("minio", {
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
            }
        ],
        containers: [{
            name: "minio",
            image: minio.image + ":" + minio.tag,
            imagePullPolicy: "IfNotPresent",
            env: [
                {
                    name: "MINIO_BROWSER_REDIRECT_URL",
                    value: "https://console.minio.k8s.orb.local"
                },
                {
                    name: "MINIO_ROOT_USER",
                    value: "minio"
                },
                {
                    name: "MINIO_ROOT_PASSWORD",
                    value: "minio123"
                }
            ],
            args: ["server", "/data", "--address", ":9000", "--console-address", ":9001"],
            ports: [
                {
                    name: "api",
                    containerPort: 9000
                },
                {
                    name: "console",
                    containerPort: 9001
                }
            ],
            volumeMounts: [{
                name: "data",
                mountPath: "/data"
            }]
        }]
    }
}, {
    dependsOn: [data]
})

const service = new Service("minio", {
    metadata: { name: "minio" },
    spec: {
        selector: { "app.kubernetes.io/name": "minio" },
        ports: [
            {
                name: "api",
                port: 9000,
                targetPort: 9000
            },
            {
                name: "console",
                port: 9001,
                targetPort: 9001
            }
        ]
    }
}, {
    dependsOn: pod,
    parent: pod
});

export default (controller: Chart) => {
    const ingress: Ingress = new Ingress("minio", {
        metadata: {
            name: "minio",
            annotations: {
                "pulumi.com/patchForce": "true",
                "nginx.ingress.kubernetes.io/backend-protocol": "HTTP",
                "nginx.ingress.kubernetes.io/enable-access-log": "false",
                "nginx.ingress.kubernetes.io/proxy-buffering": "off"
            }
        },
        spec: {
            ingressClassName: "nginx",
            rules: [
                {
                    host: "minio.k8s.orb.local",
                    http: {
                        paths: [{
                            backend: {
                                service: {
                                    name: "minio",
                                    port: { number: 9000 }
                                }
                            },
                            path: "/",
                            pathType: "Prefix"
                        }]
                    }
                },
                {
                    host: "console.minio.k8s.orb.local",
                    http: {
                        paths: [{
                            backend: {
                                service: {
                                    name: "minio",
                                    port: { number: 9001 }
                                }
                            },
                            path: "/",
                            pathType: "Prefix"
                        }]
                    }
                }
            ]
        }
    }, {
        dependsOn: [service, controller],
        parent: pod
    });

    return {
        data: data.urn,
        pod: pod.urn,
        service: service.urn,
        ingress: ingress.urn
    };
}