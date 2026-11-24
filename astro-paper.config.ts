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
    editPost: { enabled: false },
    search: "pagefind",
    toc: true,
  },
  socials: [
    { name: "github",   url: "https://github.com/Cpleasance" },
    
    { name: "linkedin", url: "https://www.linkedin.com/in/cory-pleasance-b99b80205/" },
    { name: "mail",     url: "mailto:me@corypleasance.com" },
  ],
  shareLinks: [
    { name: "linkedin", url: "https://www.linkedin.com/sharing/share-offsite/?url=", linkTitle: "Share this post on LinkedIn" },
    { name: "x",        url: "https://x.com/intent/post?url=" },
    { name: "mail",     url: "mailto:?subject=See%20this%20post&body=" },
  ],
});