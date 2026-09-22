import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://ratehub.com.ar',
  integrations: [tailwind({ applyBaseStyles: false })],
  output: 'static',
});
