import path from 'path'
import assert from 'assert'
import { execSync as exec } from 'child_process'
import fs from 'fs-extra'
import consola from 'consola'
import { packages } from '../meta/packages'
import indexes from '../meta/function-indexes'
import { version } from '../package.json'
import { updateImport } from './utils'

const rootDir = path.resolve(__dirname, '..')

const FILES_COPY_ROOT = [
  'LICENSE',
]

const FILES_COPY_LOCAL = [
  'README.md',
  'nuxt.cjs',
]

assert(process.cwd() !== __dirname)

async function buildMetaFiles() {
  for (const { name } of packages) {
    const packageRoot = path.resolve(__dirname, '..', 'packages', name)
    const packageDist = path.resolve(packageRoot, 'dist')

    if (name === 'core') {
      await fs.copyFile(path.join(rootDir, 'README.md'), path.join(packageDist, 'README.md'))
      await fs.copyFile(path.join(rootDir, 'indexes.json'), path.join(packageDist, 'indexes.json'))
    }

    for (const file of FILES_COPY_ROOT)
      await fs.copyFile(path.join(rootDir, file), path.join(packageDist, file))

    for (const file of FILES_COPY_LOCAL) {
      if (fs.existsSync(path.join(packageRoot, file)))
        await fs.copyFile(path.join(packageRoot, file), path.join(packageDist, file))
    }

    const packageJSON = await fs.readJSON(path.join(packageRoot, 'package.json'))
    for (const key of Object.keys(packageJSON.dependencies)) {
      if (key.startsWith('@vueuse/'))
        packageJSON.dependencies[key] = version
    }
    for (const key of Object.keys(packageJSON.exports)) {
      for (const key2 of Object.keys(packageJSON.exports[key])) {
        if (packageJSON.exports[key][key2].startsWith('./dist/'))
          packageJSON.exports[key][key2] = packageJSON.exports[key][key2].replace('./dist/', './')
      }
    }
    for (const key of Object.keys(packageJSON)) {
      if (typeof packageJSON[key] === 'string' && packageJSON[key].startsWith('./dist/'))
        packageJSON[key] = packageJSON[key].replace('./dist/', './')
    }
    await fs.writeJSON(path.join(packageDist, 'package.json'), packageJSON, { spaces: 2 })
  }
}

async function build() {
  consola.info('Clean up')
  exec('pnpm run clean', { stdio: 'inherit' })

  consola.info('Generate Imports')
  await updateImport(indexes)

  consola.info('Rollup')
  exec('pnpm run build:rollup', { stdio: 'inherit' })

  consola.info('Fix types')
  exec('pnpm run types:fix', { stdio: 'inherit' })

  await buildMetaFiles()
}

async function cli() {
  try {
    await build()
  }
  catch (e) {
    console.error(e)
    process.exit(1)
  }
}

export {
  build,
}

if (require.main === module)
  cli()
