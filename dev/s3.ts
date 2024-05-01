import { Pod, Service, PersistentVolumeClaim } from "@pulumi/kubernetes/core/v1";
import { Config } from "@pulumi/pulumi";

const config = new Config
const s3 = config.requireObject<{
    image: string
    tag: string
}>("s3");

export default () => {
    const data: PersistentVolumeClaim = new PersistentVolumeClaim('s3', {
        metadata: {
            name: "s3",
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

    const pod = new Pod('s3', {
        metadata: {
            name: "s3",
            labels: {
                "app.kubernetes.io/name": "s3",
                "version": s3.tag
            },
            annotations: {
                "kubectl.kubernetes.io/default-container": "s3",
                "pulumi.com/patchForce": "true"
            }
        },
        spec: {
            os: { name: "linux" },
            volumes: [{
                name: "data",
                persistentVolumeClaim: {
                    claimName: data.metadata.name
                }
            }],
            containers: [{
                name: "s3",
                image: s3.image + ":" + s3.tag,
                imagePullPolicy: "IfNotPresent",
                ports: [{ containerPort: 9000 }],
                volumeMounts: [{
                    name: "data",
                    mountPath: "/home/sirius/data"
                }],
            }]
        }
    }, {
        dependsOn: data
    })

    const service = new Service("s3", {
        metadata: { name: "s3" },
        spec: {
            selector: { "app.kubernetes.io/name": "s3" },
            ports: [{
                port: 80,
                targetPort: 9000
            }]
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