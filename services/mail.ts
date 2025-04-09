import { Config } from "@pulumi/pulumi";
import {Container, RemoteImage, RegistryImage, getRegistryImage} from "@pulumi/docker";

const config = new Config
const mail = config.requireObject<{
    image: string
    tag: string
}>("mail");

export default new Container("mail", {
    name: "mail",
    image: new RemoteImage("mailpit", {
        name: mail.image + ":" + mail.tag,
        keepLocally: true
    }).imageId,
    restart: "always",
    envs: [
        "MP_SMTP_DISABLE_RDNS=true"
    ],
    ports: [{
        internal: 1025,
        external: 1025
    }]
});
