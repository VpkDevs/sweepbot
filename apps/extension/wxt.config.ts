import { defineConfig } from 'wxt'
import react from '@vitejs/plugin-react'

// See https://wxt.dev/api/config.html
export default defineConfig({
  extensionApi: 'chrome',
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [react()],
    resolve: {
      alias: {
        '@': '/src',
      },
    },
  }),
  manifest: {
    name: 'SweepBot',
    description:
      'Real-time analytics, RTP tracking, and bonus intelligence for sweepstakes casino players.',
    version: '0.1.0',
    permissions: [
      'activeTab',
      'storage',
      'alarms',
      'notifications',
      'scripting',
      'tabs',
      'webRequest',
      'microphone',
    ],
    host_permissions: [
      // Sweepstakes casino domains — content scripts + webRequest
      '*://*.chumbacasino.com/*',
      '*://*.luckyland.com/*',
      '*://*.stake.us/*',
      '*://*.pulsz.com/*',
      '*://*.wowvegas.com/*',
      '*://*.fortunecoins.com/*',
      '*://*.funrize.com/*',
      '*://*.zulacasino.com/*',
      '*://*.crowncoinscasino.com/*',
      '*://*.mcluck.com/*',
      '*://*.nolimitcoins.com/*',
      '*://*.modocasino.com/*',
      '*://*.sweeptastic.com/*',
      '*://*.globalpoker.com/*',
      '*://*.betrivers.net/*',
      '*://*.high5casino.com/*',
      '*://*.jackpota.com/*',
      '*://*.rushgames.com/*',
      '*://*.dingdingding.com/*',
      '*://*.taofortune.com/*',
      '*://*.orioncasino.us/*',
      '*://*.spreecasino.com/*',
      '*://*.sportzino.com/*',
      '*://*.rollingriches.com/*',
      // SweepBot API
      'https://api.sweepbot.app/*',
      'https://*.supabase.co/*',
    ],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
    action: {
      default_popup: 'popup.html',
      default_title: 'SweepBot',
    },
    options_page: 'options.html',
  },
})
