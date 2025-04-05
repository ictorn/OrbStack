import { Pod, Service } from "@pulumi/kubernetes/core/v1";
import { Config } from "@pulumi/pulumi";
import { Ingress } from "@pulumi/kubernetes/networking/v1";
import { Chart } from "@pulumi/kubernetes/helm/v3";

const config = new Config
const mail = config.requireObject<{
    image: string
    tag: string
}>("mail");

const pod: Pod = new Pod("mail", {
    metadata: {
        name: "mail",
        labels: {
            "app.kubernetes.io/name": "mail",
            "version": mail.tag
        },
        annotations: {
            "kubectl.kubernetes.io/default-container": "server",
            "pulumi.com/patchForce": "true"
        }
    },
    spec: {
        os: { name: "linux" },
        containers: [{
            name: "server",
            image: mail.image + ":" + mail.tag,
            imagePullPolicy: "IfNotPresent",
            env: [
                {
                    name: "MP_SMTP_DISABLE_RDNS",
                    value: "true"
                }
            ],
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
});

const service: Service = new Service("mail", {
    metadata: { name: "mail" },
    spec: {
        selector: { "app.kubernetes.io/name": "mail" },
        ports: [
            {
                name: "webui",
                port: 8025,
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

export default (controller: Chart) => {
    const ingress: Ingress = new Ingress("mail", {
        metadata: {
            name: "mail",
            annotations: {
                "pulumi.com/patchForce": "true",
                "nginx.ingress.kubernetes.io/backend-protocol": "HTTP",
                "nginx.ingress.kubernetes.io/enable-access-log": "false",
                "nginx.ingress.kubernetes.io/proxy-buffering": "off"
            }
        },
        spec: {
            ingressClassName: "nginx",
            rules: [{
                host: "mail.k8s.orb.local",
                http: {
                    paths: [{
                        backend: {
                            service: {
                                name: "mail",
                                port: { number: 8025 }
                            }
                        },
                        path: "/",
                        pathType: "Prefix"
                    }]
                }
            }]
        }
    }, {
        dependsOn: [service, controller],
        parent: pod
    });

    return {
        pod: pod.urn,
        service: service.urn,
        ingress: ingress.urn
    }
}