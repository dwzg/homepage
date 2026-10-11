// The projects posts can belong to. A post's `project` must be one of these
// ids — the content schema is built from this list, so a typo fails the build.

export type ProjectStatus = 'running' | 'building' | 'paused' | 'retired';

export interface Project {
  id: string;
  name: string;
  description: string;
  repo?: string;
  status: ProjectStatus;
}

export const PROJECTS = [
  {
    id: 'weatherpage',
    name: 'weatherpage',
    description:
      'A balcony weather station: readings every five minutes, an archive in SQLite, and rain, cloud, fog and thunder nowcasts trained on weather-service stations.',
    repo: 'https://github.com/dwzg/weatherpage',
    status: 'running',
  },
  {
    id: 'homepage',
    name: 'homepage',
    description: 'This site. Markdown posts, built with Astro, served as static files from a container.',
    repo: 'https://github.com/dwzg/homepage',
    status: 'running',
  },
] as const satisfies readonly Project[];

export type ProjectId = (typeof PROJECTS)[number]['id'];

export const PROJECT_IDS = PROJECTS.map((p) => p.id) as [ProjectId, ...ProjectId[]];

export function getProject(id: string): Project {
  const project = PROJECTS.find((p) => p.id === id);
  if (!project) throw new Error(`Unknown project: ${id}`);
  return project;
}
