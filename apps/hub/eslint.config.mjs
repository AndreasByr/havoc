// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'
import pluginSecurity from 'eslint-plugin-security'
import nounsanitized from 'eslint-plugin-no-unsanitized'

export default withNuxt(
  pluginSecurity.configs.recommended,
  nounsanitized.configs.recommended,
)
