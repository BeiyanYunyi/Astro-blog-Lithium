import { Env } from '../types';
import { importPrivKey, importPublicKey } from './key-ops';

export const getPublicKey = async (env: Env) => importPublicKey(JSON.parse(env.PUBLIC_KEY));

export const getPrivateKey = async (env: Env) => importPrivKey(JSON.parse(env.PRIV_KEY));
