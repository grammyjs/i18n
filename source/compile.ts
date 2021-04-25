const vm = require('vm')
import {RepositoryEntry} from './types'

const regex = /`/gm

function escape (template:any) {
  return `\`${template.replace(regex, '\\`')}\``
}

function compile (template:any ) {
  if (typeof template !== 'string') {
    throw new Error('Template must be a string')
  }
  const options = Object.assign({timeout: 500})
  const script = new vm.Script(escape(template))
  return (context:any) => {
    try {
      return script.runInNewContext(Object.assign({}, undefined, context), options)
    } catch (err) {
      throw new Error('Failed to compile template')
    }
  }
}



export function compileTemplates(root: Readonly<Record<string, string>>): RepositoryEntry {
    const result: RepositoryEntry = {}
  
    for (const [key, value] of Object.entries(root)) {
      if (value.includes('${')) {
        result[key] = compile(value)
      } else {
        result[key] = () => value
      }
    }
  
    return result
  }
