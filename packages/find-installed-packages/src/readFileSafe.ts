import fs from 'fs'

/**
 * Read file and ignore ENOENT.
 * When the the folder is a link, the link may be invalid.
 * That will result in ENOENT.
 * @param path file path.
 */
export function readFileSafe(path: string) {
  try {
    return fs.readFileSync(path, 'utf8')
  }
  catch (err: any) {
    // istanbul ignore next
    if (err.code === 'ENOENT')
      return undefined
    // istanbul ignore next
    throw err
  }
}
