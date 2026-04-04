import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

async function completeOnboarding() {
  await AsyncStorage.setItem('hasLaunched', 'true');
}

export default function OnboardingScreen() {
  const [step, setStep] = useState(1);

  function next() {
    setStep((s) => s + 1);
  }

  async function handleAllowNotifications() {
    await Notifications.requestPermissionsAsync();
    next();
  }

  async function handleComplete(destination: 'create' | 'home') {
    await completeOnboarding();
    if (destination === 'create') {
      router.replace('/snippet/create');
    } else {
      router.replace('/(tabs)');
    }
  }

  if (step === 1) {
    return (
      <View>
        <Text>Panim</Text>
        <Text>A space to sit with scripture</Text>
        <Text>
          Panim helps you collect Bible passages that matter to you, pair them
          with personal reflections, and return to them throughout your day.
          It is a simple, quiet practice of meditating on scripture.
        </Text>
        <TouchableOpacity onPress={next}>
          <Text>Next</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 2) {
    return (
      <View>
        <Text>How it works</Text>
        <Text>Create snippets from Bible passages and your reflections.</Text>
        <Text>Organize them by topic — by theme or by book and chapter.</Text>
        <Text>Receive them as notifications throughout your day as quiet reminders.</Text>
        <TouchableOpacity onPress={next}>
          <Text>Next</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 3) {
    return (
      <View>
        <Text>Notifications</Text>
        <Text>
          Panim sends your snippets as notifications at times you choose — a
          gentle prompt to pause and reflect. You can set your schedule in
          Settings at any time.
        </Text>
        <TouchableOpacity onPress={handleAllowNotifications}>
          <Text>Allow Notifications</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={next}>
          <Text>Skip for now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 4) {
    return (
      <View>
        <Text>You&apos;re all set</Text>
        <Text>Start by creating your first snippet.</Text>
        <TouchableOpacity onPress={() => handleComplete('create')}>
          <Text>Create Your First Snippet</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleComplete('home')}>
          <Text>Go to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}
