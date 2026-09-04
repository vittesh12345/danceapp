// Bundles the built app (dist/) into ONE self-contained HTML file — used for
// hosted previews (e.g. Claude Artifacts) where only a single document can be
// served. Inlines the JS and CSS; strips PWA links that need extra files.
// The output intentionally has no <!doctype>/<html>/<head>/<body> wrapper —
// the artifact host provides the document shell.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dist = process.argv[2] ?? 'dist'
const out = process.argv[3] ?? 'tempo-single.html'

const html = readFileSync(join(dist, 'index.html'), 'utf8')
const jsPath = html.match(/src="\/(assets\/[^"]+\.js)"/)?.[1]
const cssPath = html.match(/href="\/(assets\/[^"]+\.css)"/)?.[1]
if (!jsPath || !cssPath) throw new Error('could not locate built assets in dist/index.html')

// </script> inside JS string literals would end the inline tag early.
const js = readFileSync(join(dist, jsPath), 'utf8').replaceAll('</script', '<\\/script')
const css = readFileSync(join(dist, cssPath), 'utf8')

const single = `<title>Tempo Dance Coach</title>
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`
writeFileSync(out, single)
console.log(`wrote ${out} (${(single.length / 1024).toFixed(0)} KB)`)
