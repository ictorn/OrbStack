import minio from "./dev/minio"
import mail from "./dev/mail"
import {getStack} from "@pulumi/pulumi";

const status: { [k: string]: object } = {};
switch (getStack()) {
    case 'dev':
        status.minio = minio()
        status.mail = mail()
        break;
    default:
        throw new Error('invalid stack')
}

export {status}