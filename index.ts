import s3 from "./dev/s3"
import debug from "./dev/debug"
import {getStack} from "@pulumi/pulumi";

const status: { [k: string]: object } = {};
switch (getStack()) {
    case 'dev':
        status.s3 = s3()
        status.debug = debug()
        break;
    default:
        throw new Error('invalid stack')
}

export {status}