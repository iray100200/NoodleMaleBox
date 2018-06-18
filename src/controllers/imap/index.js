import { Controller } from '../base'
import { ImapAccount } from './service'
import { IMAP_SCOPE } from '../../com/imap'
import params from '../../com/params'
import logger from '../../com/logger'

export default class ImapController extends Controller {
  register() {
    return {
      '@all->/receive/list/:scope': (req, res) => {
        this.receiveList(Object.assign(req.params, params(req)))
          .then(f => {
            res.status(200).send({
              data: f
            })
          })
          .catch(e => {
            res.status(500).send({ error: e || e.message })
          })
      },
      '@all->/receive/details': (req, res) => {
        this.receiveDetails(Object.assign(req.params, params(req)))
          .then(f => {
            res.status(200).send({
              data: f
            })
          })
          .catch(e => {
            res.status(500).send({ error: e || e.message })
          })
      }
    }
  }
  checkAuth(username, password, host) {
    logger.info('...Start checking auth')
    if (!username || !password || !host) {
      return Promise.reject('Username & Password & Host are required.')
    }
    try {
      return Promise.resolve(new ImapAccount(username, password, host))
    } catch (e) {
      return Promise.reject(e.message)
    }
  }
  async receiveList(params) {
    let { scope, condition, date, username, password, host, rows } = params
    if (!condition) return Promise.reject('Invalid parameters. The condition\'s type is invalid.')
    if (!date) return Promise.reject('Invalid parameters. The date\'s type is invalid.')
    if (!scope || Object.keys(IMAP_SCOPE).indexOf((scope = scope.toUpperCase())) < 0) return Promise.reject('Invalid parameters. Flag is incorrect.')
    try {
      let access = await this.checkAuth(username, password, host)
      return access.fetchList({
        scope: scope || IMAP_SCOPE.ALL,
        condition,
        date: Date.parse(date),
        rows: rows || 30
      })
    } catch (e) {
      return Promise.reject(e.message)
    }
  }
  async receiveDetails(params) {
    try {
      return ImapAccount.fetchDetails(params)
    } catch (e) {
      return Promise.reject(e.message)
    }
  }
}
