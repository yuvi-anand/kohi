import { Tabs } from 'expo-router';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../lib/colors';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({
  name,
  focused,
}: {
  name: IoniconsName;
  focused: boolean;
}) {
  return (
    <Ionicons
      name={focused ? name : (`${name}-outline` as IoniconsName)}
      size={22}
      color={focused ? Colors.roast : Colors.muted}
    />
  );
}

function CenterButton({ onPress }: { onPress?: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.centerWrapper} activeOpacity={0.85}>
      <View style={styles.centerCircle}>
        <Ionicons name="search" size={26} color={Colors.white} />
      </View>
    </TouchableOpacity>
  );
}


export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.roast,
        tabBarInactiveTintColor: Colors.muted,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ focused }) => <TabIcon name="newspaper" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="mylist"
        options={{
          title: 'Your Lists',
          tabBarIcon: ({ focused }) => <TabIcon name="list" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: '',
          tabBarButton: (props) => (
            <CenterButton onPress={props.onPress as () => void} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ focused }) => <TabIcon name="map" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} />,
        }}
      />
      {/* Hidden from tab bar */}
      <Tabs.Screen
        name="bookmarks"
        options={{ href: null }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.white,
    borderTopColor: Colors.milk,
    borderTopWidth: 1,
    height: 64,
    paddingBottom: 8,
    paddingTop: 6,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  tabItem: {
    flex: 1,
  },
  centerWrapper: {
    flex: 1,
    top: -18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.caramel,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.roast,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
});
