import path from 'node:path'
import temp from 'temp'

const CACHE_FILE = '.find-installed-packages.cache'

export function getCacheFilepath() {
	return path.join(temp.dir, CACHE_FILE)
}
