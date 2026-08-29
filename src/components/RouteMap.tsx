import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Marker, Polygon, Polyline } from 'react-native-maps';

import { boundingRegion, type GeoPoint } from '@/src/lib/geo';
import { useTheme } from '@/src/theme';

export interface RouteMapProps {
  points: GeoPoint[];
  style?: StyleProp<ViewStyle>;
  showsUserLocation?: boolean;
}

export function RouteMap({ points, style, showsUserLocation = false }: RouteMapProps) {
  const { colors } = useTheme();

  const initialRegion = boundingRegion(points);
  const bounds = boundingRegion(points, 0);
  const north = bounds.latitude + bounds.latitudeDelta / 2;
  const south = bounds.latitude - bounds.latitudeDelta / 2;
  const west = bounds.longitude - bounds.longitudeDelta / 2;
  const east = bounds.longitude + bounds.longitudeDelta / 2;
  const coverage = [
    { latitude: north, longitude: west },
    { latitude: north, longitude: east },
    { latitude: south, longitude: east },
    { latitude: south, longitude: west },
  ];

  const start = points[0];
  const end = points[points.length - 1];

  return (
    <MapView
      style={[styles.map, style]}
      initialRegion={initialRegion}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={false}
      showsCompass={false}
      accessibilityLabel="Map showing the trail route"
    >
      {points.length > 1 ? (
        <>
          <Polygon
            coordinates={coverage}
            fillColor={`${colors.primaryMuted}59`}
            strokeColor={`${colors.primary}40`}
            strokeWidth={1}
            zIndex={2}
          />
          <Polyline
            coordinates={points}
            strokeColor={colors.mapRoute}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        </>
      ) : null}
      {start ? (
        <Marker coordinate={start} title="Start" pinColor={colors.primary} />
      ) : null}
      {end && end !== start ? (
        <Marker coordinate={end} title="End" pinColor={colors.accent} />
      ) : null}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
