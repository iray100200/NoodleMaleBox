import Imap from 'imap'
import fs from 'fs'
import conf from '../../config/imap.conf'
import { inspect } from 'util'
import { Base64 } from 'js-base64'
import { Mail } from '../../com/mail'
import { IMAP_DATE, IMAP_FLAG } from '../../com/imap'
import base64 from '../../com/base64'

export class ImapAccount {
  user
  password
  host
  port
  tls
  imap
  constructor(user, password, host, port) {
    this.user = user
    this.password = password
    if (conf.hasOwnProperty(host)) {
      this.host = conf[host].host
      this.port = conf[host].port
    } else {
      this.host = host
      this.port = port || 993
    }
    this.imap = new Imap({ user: this.user, password: this.password, host: this.host, port: this.port, tls: true })
  }
  static create(imapAccount) {
    return new ImapAccount({ user: imapAccount.user, password: imapAccount.password, host: conf.hotmail, port: imapAccount.port, tls: true })
  }
  openInbox(cb) {
    this.imap.openBox('INBOX', true, cb)
  }
  imapOnError() {
    return this.imap.on('error', err => {
      console.log(err)
    })
  }
  connectImap() {
    this.imap.connect()
  }
  retrieveUnreadEmails(params) {
    let imap = this.imap
    let { scope, condition, date, rows } = params
    return new Promise((resolve, reject) => {
      imap.once('ready', () => {
        this.openInbox((err, box) => {
          if (err) {
            return reject(err)
          }
          imap.search([scope || 'ALL', [condition || 'SINCE', date || new Date()]], (err, results) => {
            if (err) {
              return reject(err)
            }
            results.length > rows ? results.length = rows : null
            if (results.length > 0) {
              let parsed = {}, raw = {}
              let f = imap.fetch(results, { bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE TEXT)', 'TEXT'], struct: true })
              f.on('message', (msg, seqno) => {
                let html, text, attributes
                raw[seqno] = {}
                msg.on('body', (stream, info) => {
                  let msgText = '', header = ''
                  stream.on('data', chunk => {
                    if (info.which === 'TEXT') {
                      msgText += chunk.toString('utf8')
                    } else {
                      header += chunk.toString('utf8')
                    }
                  })
                  let end = stream.once('end', () => {
                    const simpleParser = require('mailparser').simpleParser
                    simpleParser(msgText, (err, mail) => { })
                    if (info.which === 'TEXT') {
                      raw[seqno].body = msgText
                    } else {
                      raw[seqno].header = header // Imap.parseHeader();
                    }
                  })
                })
                msg.once('attributes', attrs => {
                  raw[seqno].attributes = attrs
                })
                msg.once('end', () => {
                  let r = raw[seqno]
                  let mail = new Mail(r.body, r.attributes.struct)
                  let t = mail.parse()
                  parsed[seqno] = {
                    header: Imap.parseHeader(r.header),
                    attributes: r.attributes,
                    body: t
                  }
                })
              })
              f.once('error', err => {
                reject(err)
              })
              f.once('end', () => {
                resolve(parsed)
                imap.end()
              })
            } else {
              resolve({})
            }
          })
        })
      })

      imap.once('error', function (err) {
        reject(err)
      })

      imap.once('end', function (chunk) {
        console.log('Imap connection ended!')
      })

      imap.connect()
    })
  }
}
