import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useNotion } from "@/context/NotionContext";

export function SetupScreen() {
  const insets = useSafeAreaInsets();
  const {
    apiKey,
    setApiKey,
    databases,
    databaseId,
    setDatabaseId,
    fetchDatabases,
    isLoading,
    error,
  } = useNotion();

  const [inputKey, setInputKey] = useState(apiKey || "");
  const [step, setStep] = useState<"key" | "database">(
    apiKey ? "database" : "key"
  );

  const handleConnectKey = async () => {
    if (!inputKey.trim()) {
      Alert.alert("Error", "Please enter your Notion API key");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await setApiKey(inputKey.trim());
    await fetchDatabases();
    setStep("database");
  };

  const handleSelectDatabase = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setDatabaseId(id);
  };

  const topPad =
    Platform.OS === "web"
      ? Math.max(insets.top, 67)
      : insets.top;
  const bottomPad =
    Platform.OS === "web"
      ? Math.max(insets.bottom, 34)
      : insets.bottom;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: topPad }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 20 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoRow}>
          <View style={styles.logoBox}>
            <Feather name="check-square" size={28} color={Colors.primary} />
          </View>
          <Text style={styles.appName}>TaskBoard</Text>
        </View>

        <Text style={styles.headline}>Connect to Notion</Text>
        <Text style={styles.subline}>
          Pull your tasks directly from Notion databases and manage them on the
          go.
        </Text>

        {step === "key" ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>NOTION API KEY</Text>
            <TextInput
              style={styles.input}
              value={inputKey}
              onChangeText={setInputKey}
              placeholder="secret_xxxxxxxxxxxxxxxx"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <Text style={styles.hint}>
              Create an integration at notion.so/my-integrations and copy the
              Internal Integration Token.
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleConnectKey}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="link" size={16} color="#fff" />
                  <Text style={styles.buttonText}>Connect</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>SELECT DATABASE</Text>
              <Pressable
                onPress={() => setStep("key")}
                style={styles.changeBtn}
              >
                <Text style={styles.changeBtnText}>Change key</Text>
              </Pressable>
            </View>

            {isLoading ? (
              <ActivityIndicator
                color={Colors.primary}
                style={{ marginVertical: 20 }}
              />
            ) : databases.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="database" size={32} color={Colors.textMuted} />
                <Text style={styles.emptyText}>
                  No databases found. Make sure your integration has access to
                  at least one database.
                </Text>
                <Pressable style={styles.retryBtn} onPress={fetchDatabases}>
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {databases.map((db) => (
                  <Pressable
                    key={db.id}
                    style={[
                      styles.dbItem,
                      databaseId === db.id && styles.dbItemActive,
                    ]}
                    onPress={() => handleSelectDatabase(db.id)}
                  >
                    <Feather
                      name="database"
                      size={18}
                      color={
                        databaseId === db.id
                          ? Colors.primary
                          : Colors.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.dbName,
                        databaseId === db.id && styles.dbNameActive,
                      ]}
                    >
                      {db.title}
                    </Text>
                    {databaseId === db.id && (
                      <Feather
                        name="check-circle"
                        size={16}
                        color={Colors.primary}
                      />
                    )}
                  </Pressable>
                ))}
              </>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.darkBg,
  },
  scroll: {
    padding: 24,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 32,
  },
  logoBox: {
    width: 44,
    height: 44,
    backgroundColor: "rgba(224, 49, 49, 0.15)",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(224, 49, 49, 0.3)",
  },
  appName: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  headline: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    marginBottom: 10,
  },
  subline: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    marginBottom: 32,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
  },
  changeBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  changeBtnText: {
    color: Colors.primary,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  input: {
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    color: Colors.textPrimary,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  hint: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  error: {
    color: Colors.primary,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  dbItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dbItemActive: {
    borderColor: Colors.primary,
    backgroundColor: "rgba(224, 49, 49, 0.08)",
  },
  dbName: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  dbNameActive: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 12,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },
  retryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
  },
  retryText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
