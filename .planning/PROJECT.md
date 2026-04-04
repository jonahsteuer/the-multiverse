# The Multiverse — Project

## Vision

An AI-powered music artist management platform. Mark (the AI) serves as a personal creative strategist for independent musicians — helping them plan releases, understand their content performance, and improve their Instagram strategy using data-driven intelligence.

## Core Principles

- Mark should give advice anchored to the artist's own data, not generic tips
- Intelligence layers: Universal Truths (T1) → Live Trends (T2) → Artist-specific analytics (T3)
- Features should work for real artists on real accounts — production quality, not prototypes
- Minimize friction; maximize insight

## Stack

- Next.js 15 (App Router), TypeScript, Tailwind CSS
- Supabase (auth + database)
- Apify (Instagram scraping)
- Anthropic Claude API
- Vercel deployment (Pro tier, 300s max function duration)

## Non-Negotiables

- No module-level Supabase client instantiation (breaks Vercel build)
- Mark's intelligence is always assembled from all available tiers — never truncated
- Analytics data must be accurate: use `videoPlayCount` (public plays), not `videoViewCount` (reach)

## Milestones

### Milestone 1: Instagram Analytics Foundation
Build a rich, accurate Instagram analytics pipeline that gives Mark deep per-artist context, powered by OAuth (saves + Insights) and Apify (public signals), with Claude-generated gap analysis.

**Phase 01 complete (2026-04-03):** Instagram analytics pipeline fully enriched — audio/music metadata, hashtag ER correlation, carousel detection, caption tone, Claude gap analysis (T1/T2 cross-reference), Instagram OAuth routes, Graph API saves+reach per post (token refresh-on-read). SAVES card verified live with real OAuth token. Production OAuth end-to-end deferred to Vercel deploy.
