// packages/ui — shared design system barrel export
// Components will be added here as the UI library grows.
// Both apps/admin and apps/storefront import from this package.

// Re-export Tailwind config for downstream apps
export { default as tailwindConfig } from '../tailwind.config';

// Placeholder — actual component exports added per-phase
export {};

export * from './DataTable';
