import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./!(node_modules)/**/*.(vue|jsx|tsx)'],
  theme: {
    extend: {}
  },
  plugins: []
}

export default config
