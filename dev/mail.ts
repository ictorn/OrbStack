import { Pod, Service } from "@pulumi/kubernetes/core/v1";
import { Config } from "@pulumi/pulumi";
export default () => {
    const config = new Config
    const mail = config.requireObject<{
        image: string
        tag: string
    }>("mail");

    const pod: Pod = new Pod('mail', {
        metadata: {
            name: "mail",
            labels: {
                "app.kubernetes.io/name": "mail",
                "version": mail.tag
            },
            annotations: {
                "kubectl.kubernetes.io/default-container": "mailhog",
                "pulumi.com/patchForce": "true"
            }
        },
        spec: {
            os: { name: "linux" },
            containers: [{
                name: "mailhog",
                image: mail.image + ":" + mail.tag,
                imagePullPolicy: "IfNotPresent",
                ports: [
                    {
                        name: "webui",
                        containerPort: 8025
                    },
                    {
                        name: "smtp",
                        containerPort: 1025
                    }
                ]
            }]
        }
    })

    const service: Service = new Service("mail", {
        metadata: { name: "mail" },
        spec: {
            selector: { "app.kubernetes.io/name": "mail" },
            ports: [
                {
                    name: "webui",
                    port: 80,
                    targetPort: 8025
                },
                {
                    name: "smtp",
                    port: 25,
                    targetPort: 1025
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