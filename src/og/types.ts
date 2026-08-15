export type OGType = 'repository' | 'website' | 'custom';
export type Theme = 'dark' | 'light';

export interface ThemeOptions {
  background: string; // hex without #
  textColor: string; // hex without #
  theme: Theme;
}

export interface RepositoryOGOptions extends ThemeOptions {
  type: 'repository';
  projectLogo: string;
  projectName: string;
  projectBadgeText: string;
  projectBadgeIcon: string;
  headline: string;
  description: string;
  features: string[];
  featureColors: string[];
  publisherLogo: string;
  publisherName: string;
  publisherTags: string[];
}

export interface WebsiteOGOptions extends ThemeOptions {
  type: 'website' | 'custom';
  headerTitle: string;
  headerSubtitle: string;
  mainImage: string;
  mainImagePosition: 'left' | 'right';
  heading: string;
  subheading: string;
  description: string;
  footerText: string;
  url: string;
  urlIcon: string;
  urlIconMode: 'auto' | 'custom' | 'none';
  urlIconPosition: 'left' | 'right';
}

export type OGOptions = RepositoryOGOptions | WebsiteOGOptions;
