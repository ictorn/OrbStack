import { Pod, Service, Secret } from "@pulumi/kubernetes/core/v1";
import { Config } from "@pulumi/pulumi";
import {execSync} from "child_process";
import {readFileSync, unlinkSync} from "fs";
export default () => {
    const config = new Config
    const mail = config.requireObject<{
        image: string
        tag: string
    }>("mail");

    execSync(`mkcert -cert-file tls.crt -key-file tls.key 127.0.0.1 ::1 localhost "mail.svc.cluster.local"`);

    const ssl: Secret = new Secret("mail.ssl", {
        metadata: {
            name: "mail.ssl"
        },
        type: "tls",
        data: {
            "tls.crt": readFileSync('tls.crt', 'base64'),
            "tls.key": readFileSync('tls.key', 'base64')
        }
    });

    unlinkSync('tls.crt');
    unlinkSync('tls.key');

    const pod: Pod = new Pod('mail', {
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
            volumes: [{
                name: "ssl",
                secret: {
                    secretName: ssl.metadata.name
                }
            }],
            containers: [{
                name: "server",
                image: mail.image + ":" + mail.tag,
                imagePullPolicy: "IfNotPresent",
                env: [
                    {
                        name: "MP_UI_TLS_CERT",
                        value: "/cert/tls.crt"
                    },
                    {
                        name: "MP_UI_TLS_KEY",
                        value: "/cert/tls.key"
                    },
                    {
                        name: "MP_SMTP_DISABLE_RDNS",
                        value: "true"
                    }
                ],
                volumeMounts: [
                    {
                        mountPath: "/cert",
                        name: "ssl",
                        readOnly: true
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
    }, {
        dependsOn: ssl
    })

    const service: Service = new Service("mail", {
        metadata: { name: "mail" },
        spec: {
            selector: { "app.kubernetes.io/name": "mail" },
            ports: [
                {
                    name: "webui",
                    port: 443,
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