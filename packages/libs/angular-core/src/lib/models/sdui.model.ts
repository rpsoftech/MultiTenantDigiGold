export interface SDUIComponentConfig {
  id: string;
  type: string;
  variant: string;
  props: Record<string, unknown>;
  children?: SDUIComponentConfig[];
}

export interface SDUITenantTheme {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  logoUrl?: string;
}

export interface SDUIPageLayout {
  pageId: string;
  theme: SDUITenantTheme;
  components: SDUIComponentConfig[];
}
