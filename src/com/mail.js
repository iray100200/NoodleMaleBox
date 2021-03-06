import iconv from 'iconv-lite'
import traverse from './traverse'
import quotedPrintable from 'quoted-printable'
import logger from './logger';

let encodings = ['ascii', 'utf8', 'utf16le', 'ucs2', 'base64', 'latin1', 'binary', 'hex']

export class Mail {
  raw
  structure
  constructor(str, _struct) {
    this.raw = str.replace(/^\"([\w\W]*)\"$/, '$1')
    this.structure = _struct
  }
  decode(str, _struct) {
    let { encoding, type, params } = _struct
    let buf
    switch (type) {
      case 'text':
        try {
          if (encodings.indexOf(encoding) > -1) {
            buf = Buffer.from(str, encoding)
          } else {
            switch (encoding) {
              case 'quoted-printable':
                buf = quotedPrintable.decode(str)
                break
              default:
                return str
            }
          }
        } catch (e) {
          console.log(e)
        }
        if (buf) return iconv.decode(buf, params.charset || 'gb2312')
      default:
        return str
    }
  }
  parse() {
    switch (this.structure.length) {
      case 1:
        let struct = this.structure[0]
        let text = this.decode(this.raw, struct)
        return {
          text,
          struct
        }
      default:
        let f = traverse(this.structure)
        let k = f
          .filter(o => {
            return o.params && o.params.boundary
          })
          .map(o => {
            let boundary = o.params.boundary
            return {
              raw: boundary,
              reg: boundary.replace(/\-/g, '').replace(/(\W)/g, '\\$1')
            }
          })
        let r = []
        f.filter(o => {
          return o.size
        }).forEach(o => {
          let t = []
          let pids = o.partID.split('.').map(o => {
            return Number(o)
          })
          pids.forEach((o, i) => {
            let spt = `--${k[i].raw}\r\n`
            let reg = new RegExp(`[\\-]*${k[i].reg}[\\-]*`, 'g')
            try {
              let _t = i < 1 ? this.raw : t[i - 1]
              t[i] = _t.split(spt)[o].replace(reg, '')
            } catch (e) {
              logger.error(e.message, reg)
            }
          })
          r.push({
            text: t[pids.length - 1],
            struct: o
          })
        })
        try {
          let q = r.map(f => {
            f.text = this.decode(f.text.trim().split(/\r\n\r\n/).slice(1).join(''), f.struct)
            return f
          })
          let hmlIdx = q.findIndex(o => {
            return o.struct.subtype === 'html'
          })
          let imgs = q.filter(o => {
            return o.struct.type === 'image'
          })
          imgs.forEach(o => {
            let imgId = o.struct.id
            q[hmlIdx].text = q[hmlIdx].text.replace(`cid:${imgId.substring(1, imgId.length - 1)}`, `data:image/${o.struct.subtype};base64,${o.text}`)
          })
          return q
        } catch (e) {
          logger.error(e.message)
          return {}
        }
    }
  }
}
