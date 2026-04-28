
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://gryfobekzlmfonnrwbpg.supabase.co";
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtaXdqcXNidWNwcW5waWZ3bmh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA2NzY2MywiZXhwIjoyMDg4NjQzNjYzfQ.QrlLUYXHidCMdcnaCuJzOOVcdranakGTPmxgOUAbJGQ";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function wipeNotifications() {
  console.log('🚀 Wiping ALL notifications in ALL accounts...');
  
  const { error } = await supabase
    .from('notifications')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); 

  if (error) {
    console.error('❌ Failed to wipe notifications:', error);
  } else {
    console.log('✅ Success! Notifications wiped.');
  }
}

wipeNotifications();
