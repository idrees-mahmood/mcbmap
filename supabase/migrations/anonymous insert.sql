CREATE POLICY "Allow anonymous insert on business_nodes" 
ON business_nodes FOR INSERT 
TO anon 
WITH CHECK (true);