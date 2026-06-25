import { TerminalHero } from '@/components/TerminalHero'
import { SkillsChart } from '@/components/SkillsChart'
import { GithubStatsCard } from '@/components/GithubStatsCard'
import { ContactForm } from '@/components/ContactForm'
import { ProjectCard } from '@/components/ProjectCard'

const PROJECTS = [
  {
    title: 'This Portfolio',
    description:
      'Full-stack portfolio site built with Next.js 15, deployed to AWS S3+CloudFront via Terraform and GitHub Actions OIDC. Includes serverless APIs (Lambda + API Gateway), DynamoDB visitor tracking, and SES contact form.',
    tech: ['Next.js', 'TypeScript', 'Terraform', 'AWS Lambda', 'DynamoDB', 'GitHub Actions'],
    repo: 'https://github.com/jp64057/portfolio',
  },
]

export default function Home() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16 space-y-24">
      <TerminalHero />

      <section id="projects">
        <h2 className="text-2xl font-bold mb-8">Projects</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {PROJECTS.map((p) => (
            <ProjectCard key={p.title} {...p} />
          ))}
        </div>
      </section>

      <section id="skills">
        <h2 className="text-2xl font-bold mb-8">Skills</h2>
        <SkillsChart />
      </section>

      <section id="github">
        <h2 className="text-2xl font-bold mb-8">GitHub Activity</h2>
        <GithubStatsCard />
      </section>

      <section id="contact">
        <h2 className="text-2xl font-bold mb-8">Contact</h2>
        <ContactForm />
      </section>
    </div>
  )
}
