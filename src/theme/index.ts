import { useColorScheme } from 'react-native';
import { palettes, radius, spacing, type Palette, type ThemeName } from './colors';

export { palettes, radius, spacing };
export type { Palette, ThemeName };

export function useTheme(): { name: ThemeName; colors: Palette } {
  const scheme = useColorScheme();
  const name: ThemeName = scheme === 'dark' ? 'dark' : 'light';
  return { name, colors: palettes[name] };
}
