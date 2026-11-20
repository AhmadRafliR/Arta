import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { BentukCrestSvg, CREST_AKSEN, CREST_BADAN, CREST_VIEWBOX_RAPAT } from './MarkPremium';

// Ukuran di bawah mengikuti desain badge 200×64 (docs/design/arta/badge-*.svg), diskalakan ke `tinggi`.
const TINGGI_DESAIN = 64;

/**
 * Badge paket langganan berbentuk pil. Free: latar kartu bergaris + glyph dompet; Pro: gradien teal
 * + crest premium (sama di kedua mode). Teks memakai NunitoSans agar seragam dengan app.
 */
export function BadgeTier({ tier, tinggi = 32 }: { tier: 'free' | 'pro'; tinggi?: number }) {
  const { t } = useTheme();
  const s = tinggi / TINGGI_DESAIN;
  const pro = tier === 'pro';
  const teks = {
    fontSize: 22 * s,
    lineHeight: 28 * s,
    letterSpacing: (pro ? 2 : 1) * s,
    color: pro ? '#FFFFFF' : t.fg,
    includeFontPadding: false,
  };

  return (
    <View
      accessible
      accessibilityLabel={pro ? 'Paket Pro' : 'Paket Free'}
      style={{
        height: tinggi,
        borderRadius: tinggi / 2,
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        flexShrink: 0, // jangan menyusut di baris sempit (teks "PRO" terpotong)
        overflow: 'hidden',
        paddingLeft: (pro ? 20 : 14) * s,
        paddingRight: 22 * s,
        gap: (pro ? 10 : 14) * s,
        backgroundColor: pro ? undefined : t.card,
        borderWidth: pro ? 0 : Math.max(1, 2 * s),
        borderColor: t.line,
      }}
    >
      {pro ? (
        <>
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id="proBadgeGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#0B424F" />
                <Stop offset="1" stopColor="#1F6A76" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#proBadgeGrad)" />
          </Svg>
          {/* Dibungkus View (position relative) agar di web tidak tertutup Svg gradien absolut. */}
          <View>
            <Svg width={27.2 * s} height={43.1 * s} viewBox={CREST_VIEWBOX_RAPAT}>
              <BentukCrestSvg bentuk={CREST_BADAN} fill="#FFFFFF" />
              <BentukCrestSvg bentuk={CREST_AKSEN} fill="#52C3BF" />
            </Svg>
          </View>
        </>
      ) : (
        <Svg width={27.5 * s} height={19 * s} viewBox="13.5 20 27.5 19">
          <Rect x="18" y="22" width="22" height="15" rx="4" fill="none" stroke={t.fg2} strokeWidth={2} />
          <Path
            d="M29 29.5 H40 V37 H29"
            fill="none"
            stroke={t.fg2}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx="17" cy="29.5" r="2.4" fill={t.fg2} />
        </Svg>
      )}
      <Text className="font-sans font-semibold" style={teks}>
        {pro ? 'PRO' : 'Free'}
      </Text>
    </View>
  );
}
