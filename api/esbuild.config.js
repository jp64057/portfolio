import { build } from 'esbuild'
import { readdirSync, mkdirSync } from 'fs'
import { join } from 'path'

const functions = readdirSync('./functions')

await Promise.all(
  functions.map((fn) =>
    build({
      entryPoints: [`./functions/${fn}/handler.ts`],
      bundle: true,
      platform: 'node',
      target: 'node22',
      format: 'cjs',
      outfile: `./dist/${fn}/handler.js`,
      external: [],
      minify: true,
    }).then(() => {
      console.log(`✓ bundled ${fn}`)
    })
  )
)
