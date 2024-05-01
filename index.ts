import minio from "./dev/minio"
import debug from "./dev/debug"
import {getStack} from "@pulumi/pulumi";

const status: { [k: string]: object } = {};
switch (getStack()) {
    case 'dev':
        status.minio = minio()
        status.debug = debug()
        break;
    default:
        throw new Error('invalid stack')
}

export {status}