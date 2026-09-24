export ANTHROPIC_DEFAULT_HAIKU_MODEL='gpt-5.6-luna'

claudex() {
  claude --model 'gpt-6-astra(xhigh)' --settings '{"effortLevel":"xhigh"}'
}

claudeg() {
  claude --model 'grok-4.6'
}
