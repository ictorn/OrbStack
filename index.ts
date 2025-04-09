import mail from "./services/mail"
import {Config} from "@pulumi/pulumi";
import {Chart} from "@pulumi/kubernetes/helm/v3";

const config = new Config;
const ingressConfig = config.requireObject<{
    repo: string,
    chart: string,
    version: string
}>("ingress");

const ingress = new Chart("ingress-nginx", {
    chart: ingressConfig.chart,
    version: ingressConfig.version,
    fetchOpts: { repo: ingressConfig.repo }
});

export default {
    ingress: ingress.urn,
    mail: mail
};
