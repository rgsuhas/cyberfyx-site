/**
 * Static fallback data - mirrors current hardcoded page content.
 * Used when the backend is unavailable during `astro build`.
 */

import type { SolutionTrackDetail, ContactProfile } from './api';

export const CYBERSECURITY_FALLBACK: SolutionTrackDetail = {
  slug: 'cybersecurity',
  title: 'Cybersecurity',
  short_summary: 'Risk reduction, testing, privacy, and strategic leadership.',
  hero_title: 'Cybersecurity',
  hero_body: 'Risk reduction, testing, privacy, and strategic leadership for teams that need practical security programs, assurance, and decision support.',
  cta_label: 'Get in touch',
  cta_target: '/contact',
  display_order: 1,
  meta_title: 'Cybersecurity | Cyberfyx',
  meta_description: 'Risk reduction, testing, privacy, and strategic leadership.',
  offerings: [
    {
      slug: 'vulnerability-assessment',
      title: 'Vulnerability Assessment',
      kicker: 'VAPT & Red Teaming',
      description: 'Comprehensive testing across web, mobile, network, and cloud infrastructure.',
      display_order: 1,
      taxonomy_terms: [],
    },
    {
      slug: 'virtual-ciso',
      title: 'Virtual CISO',
      kicker: 'vCISO & DPO Support',
      description: 'Strategic leadership, roadmap planning, and board-level reporting.',
      display_order: 2,
      taxonomy_terms: [],
    },
  ],
  endpoint_rows: [],
};

export const IT_SECURITY_FALLBACK: SolutionTrackDetail = {
  slug: 'it-security',
  title: 'IT Security',
  short_summary: 'Framework implementation, internal audits, continuity, and cloud governance.',
  hero_title: 'IT Security',
  hero_body: 'Framework implementation, internal audits, continuity, and cloud governance for organizations that need standards translated into working controls.',
  cta_label: 'Get in touch',
  cta_target: '/contact',
  display_order: 2,
  meta_title: 'IT Security | Cyberfyx',
  meta_description: 'Framework implementation, internal audits, continuity, and cloud governance.',
  offerings: [
    {
      slug: 'compliance-frameworks',
      title: 'Compliance Frameworks',
      kicker: 'ISO 27001 / 27701 Implementation',
      description: 'Get audit-ready and build robust ISMS tailored to your business needs.',
      display_order: 1,
      taxonomy_terms: [],
    },
    {
      slug: 'operational-continuity',
      title: 'Operational Continuity',
      kicker: 'ISO 22301 Continuity Planning',
      description: 'Build resilience and disaster recovery strategies mapping to ISO 22301.',
      display_order: 2,
      taxonomy_terms: [],
    },
  ],
  endpoint_rows: [],
};

export const ENDPOINT_FALLBACK: SolutionTrackDetail = {
  slug: 'endpoint-operations',
  title: 'Endpoint Operations',
  short_summary: 'Visibility, automation, monitoring, and lifecycle control.',
  hero_title: 'Endpoint Operations',
  hero_body: 'Visibility, automation, monitoring, and lifecycle control for IT teams balancing device growth, compliance, and resilience.',
  cta_label: 'Get in touch',
  cta_target: '/contact',
  display_order: 3,
  meta_title: 'Endpoint Operations | Cyberfyx',
  meta_description: 'Visibility, automation, monitoring, and lifecycle control.',
  offerings: [
    {
      slug: 'uem-deployment',
      title: 'UEM Deployment',
      kicker: 'Unified Endpoint Management',
      description: 'Implement comprehensive control, tracking, and management for vast device fleets.',
      display_order: 1,
      taxonomy_terms: [],
    },
    {
      slug: 'security-posture-monitoring',
      title: 'Security Posture Monitoring',
      kicker: 'SIEM Integration',
      description: 'Continuous monitoring to detect non-compliance and secure the expanded attack surface.',
      display_order: 2,
      taxonomy_terms: [],
    },
  ],
  endpoint_rows: [],
};

export const CORE_INDUSTRY_FALLBACK: SolutionTrackDetail = {
  slug: 'core-industry-services',
  title: 'Core Industry Services',
  short_summary: 'Management systems, sector audits, and industrial assurance.',
  hero_title: 'Core Industry Services',
  hero_body: 'Management systems, sector audits, and industrial assurance for operations and supplier teams.',
  cta_label: 'Get in touch',
  cta_target: '/contact',
  display_order: 4,
  meta_title: 'Core Industry Services | Cyberfyx',
  meta_description: 'Management systems, sector audits, and industrial assurance.',
  offerings: [
    {
      slug: 'audit-readiness',
      title: 'Audit Readiness',
      kicker: 'ISO & SEDEX Compliance',
      description: 'Prepare for external audits with robust internal documentation and mock inspections.',
      display_order: 1,
      taxonomy_terms: [],
    },
    {
      slug: 'quality-assurance',
      title: 'Quality Assurance',
      kicker: 'FSC & Fire Safety Audits',
      description: 'Deploy industrial standards and integrate QMS for superior supply chain confidence.',
      display_order: 2,
      taxonomy_terms: [],
    },
  ],
  endpoint_rows: [],
};

export const TRAINING_FALLBACK: SolutionTrackDetail = {
  slug: 'training',
  title: 'Training',
  short_summary: 'Capability building for security, privacy, governance, and recovery teams.',
  hero_title: 'Training',
  hero_body: 'Capability building for organizations that need internal awareness and audit readiness to sustain change.',
  cta_label: 'Get in touch',
  cta_target: '/contact',
  display_order: 5,
  meta_title: 'Training | Cyberfyx',
  meta_description: 'Capability building for security, privacy, governance, and recovery teams.',
  offerings: [
    {
      slug: 'executive-training',
      title: 'Executive Training',
      kicker: 'ISO & NIST Awareness',
      description: 'Strategic cyber awareness programs targeted to board members and executives.',
      display_order: 1,
      taxonomy_terms: [],
    },
    {
      slug: 'technical-workshops',
      title: 'Technical Workshops',
      kicker: 'GDPR, HIPAA, PCI DSS',
      description: 'Hands-on skill building for SOC analysts, network engineers, and IT administrators.',
      display_order: 2,
      taxonomy_terms: [],
    },
  ],
  endpoint_rows: [],
};

export const CONTACT_PROFILE_FALLBACK: ContactProfile = {
  profile_key: 'primary',
  sales_email: 'sales@cyberfyx.net',
  hr_email: 'hr@cyberfyx.net',
  primary_phone: '+91 9663410308',
  headquarters_name: 'Cyberfyx',
  headquarters_address: 'Janardhana Towers, Ashok Nagar, Bengaluru 560025',
  map_url: 'https://www.google.com/maps/search/?api=1&query=Janardhana%20Towers%2C%20Ashok%20Nagar%2C%20Bengaluru%20560025',
  office_regions: [
    { slug: 'india', label: 'India', display_order: 1 },
    { slug: 'singapore', label: 'Singapore', display_order: 2 },
    { slug: 'philippines', label: 'Philippines', display_order: 3 },
    { slug: 'dubai', label: 'Dubai', display_order: 4 },
  ],
  interest_options: [],
};
