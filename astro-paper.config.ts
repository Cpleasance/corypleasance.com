import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://corypleasance.com/",
    title: "Cory Pleasance",
    description: "Data Science & AI Student at the University of Stirling. Writing about AI security, agent evaluation, and systems engineering.",
    author: "Cory Pleasance",
    profile: "https://github.com/Cpleasance",
    ogImage: "default-og.jpg",
    lang: "en",
    timezone: "Europe/London",
    dir: "ltr",
  },
  posts: {
    perPage: 4,
    perIndex: 4,
  },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: true,
    showArchives: true,
    showBackButton: true,
    editPost: {
      enabled: true,
      url: "https://github.com/Cpleasance/corypleasance.com/edit/main/",
    },
    search: "pagefind",
    toc: true,
  },
  socials: [
    { name: "github",   url: "https://github.com/Cpleasance" },
    
    { name: "linkedin", url: "https://linkedin.com" },
    { name: "mail",     url: "mailto:me@corypleasance.com" },
  ],
  shareLinks: [
    { name: "whatsapp", url: "https://wa.me/?text=" },
    { name: "facebook", url: "https://www.facebook.com/sharer.php?u=" },
    { name: "x",        url: "https://x.com/intent/post?url=" },
    { name: "telegram", url: "https://t.me/share/url?url=" },
    { name: "pinterest", url: "https://pinterest.com/pin/create/button/?url=" },
    { name: "mail",     url: "mailto:?subject=See%20this%20post&body=" },
  ],
});