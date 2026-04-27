import { colors } from "@/src/constants/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

export default function Index() {
  const [hasLaunched, setHasLaunched] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("hasLaunched").then((value) => {
      setHasLaunched(value !== null);
    });
  }, []);

  if (hasLaunched === null) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  if (!hasLaunched) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}
