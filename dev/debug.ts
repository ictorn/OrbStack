import { Pod, Service, PersistentVolumeClaim } from "@pulumi/kubernetes/core/v1";
import { Config } from "@pulumi/pulumi";

const config = new Config
const debug = config.requireObject<{
    image: string
    tag: string
}>("debug");

export default () => {
    const pod = new Pod('debug', {
        metadata: {
            name: "debug",
            labels: {
                "app.kubernetes.io/name": "debug",
                "version": debug.tag
            },
            annotations: {
                "kubectl.kubernetes.io/default-container": "debug",
                "pulumi.com/patchForce": "true"
            }
        },
        spec: {
            os: { name: "linux" },
            containers: [{
                name: "debug",
                image: debug.image + ":" + debug.tag,
                imagePullPolicy: "IfNotPresent",
                ports: [
                    {
                        name: "webui",
                        containerPort: 8000
                    },
                    {
                        name: "smtp",
                        containerPort: 1025
                    },
                    {
                        name: "var-dumper",
                        containerPort: 9912
                    },
                    {
                        name: "monolog",
                        containerPort: 9913
                    }
                ]
            }]
        }
    })

    const service = new Service("debug", {
        metadata: { name: "debug" },
        spec: {
            selector: { "app.kubernetes.io/name": "debug" },
            ports: [
                {
                    name: "webui",
                    port: 80,
                    targetPort: 8000
                },
                {
                    name: "smtp",
                    port: 25,
                    targetPort: 1025
                },
                {
                    name: "var-dumper",
                    port: 9912,
                    targetPort: 9912
                },
                {
                    name: "monolog",
                    port: 514,
                    targetPort: 9913
                }
            ]
        }
    }, {
        dependsOn: pod,
        parent: pod
    });

    return {
        pod: pod.status,
        service: service.status
    }
}