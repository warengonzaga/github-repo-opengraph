export interface OGOptions {
  logo: string; // URL or ![slug]
  logoText: string;
  badge: string; // empty = hide
  badgeIcon: string; // URL or ![slug], empty = hide
  title: string; // supports ![slug]
  highlight: string; // word in title to gradient-highlight
  description: string;
  pills: string[]; // pill labels
  pillColors: string[]; // dot color per pill: blurple|fuchsia|green|yellow
  footerLogo: string; // URL or ![slug]
  footerText: string;
  footerTag: string[];
  bg: string; // hex without #
  color: string; // hex without #
  theme: 'dark' | 'light';
}
