import type { APIRoute } from "astro";
import { renderOgCard } from "@/utils/renderOgCard";

// Link-preview cards for the standalone pages, in the same style as posts.
const pages = {
  about: {
    title: "About",
    subtitle: "Data Science & AI · University of Stirling",
  },
  projects: {
    title: "Projects",
    subtitle: "Competitions, research code and systems projects.",
  },
  experience: {
    title: "Experience",
    subtitle: "Research, work experience and the tools I use.",
  },
} as const;

export function getStaticPaths() {
  return Object.entries(pages).map(([page, card]) => ({
    params: { page },
    props: card,
  }));
}

export const GET: APIRoute = ({ props, url }) =>
  renderOgCard(props.title, url, props.subtitle);
