import { Pressable, StyleSheet, View } from 'react-native';
import { space } from '@/theme';
import { Eyebrow, Mono, Title } from './Text';

export function PageHeader({ title, context, action }: { title: string; context?: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.root}>
      <View style={styles.title}>
        {context ? <Eyebrow>{context}</Eyebrow> : null}
        <Title>{title}</Title>
      </View>
      {action ? <Pressable onPress={action.onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel={action.label}><Mono>{action.label}</Mono></Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.lg },
  title: { flex: 1, gap: space.xs },
});
