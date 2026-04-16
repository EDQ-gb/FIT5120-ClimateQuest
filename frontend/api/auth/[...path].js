import { proxyWithPrefix } from '../_proxyBase.js'

export default async function handler(req, res) {
  return proxyWithPrefix(req, res, 'auth')
}

