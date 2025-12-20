/**
 * Run SQL Migrations via Supabase Management API
 * This uses the SQL endpoint to execute DDL statements
 */

import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

config()

const __dirname = dirname(fileURLToPath(import.meta.url))

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing credentials in .env')
    process.exit(1)
}

async function executeSQLViaRPC(sql) {
    // First, create the exec_sql function if it doesn't exist
    // Then use it to run our migrations
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql_query: sql })
    })

    return response
}

async function testConnection() {
    console.log('🔍 Testing Supabase connection...\n')

    // Try a simple query using the PostgREST API
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'GET',
        headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`
        }
    })

    if (response.ok) {
        const data = await response.json()
        console.log('✅ Connection successful!')
        console.log(`   Available endpoints: ${JSON.stringify(data).substring(0, 200)}...`)
        return true
    } else {
        console.log(`❌ Connection failed: ${response.status} ${response.statusText}`)
        const text = await response.text()
        console.log(`   ${text.substring(0, 200)}`)
        return false
    }
}

async function checkPostGIS() {
    console.log('\n🗺️  Checking PostGIS extension...')

    // Try to query if postgis is enabled
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/postgis_version`, {
        method: 'POST',
        headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json'
        },
        body: '{}'
    })

    if (response.ok) {
        const version = await response.text()
        console.log(`   PostGIS version: ${version}`)
        return true
    } else {
        console.log('   PostGIS function not found - extension may need to be enabled')
        return false
    }
}

async function checkTables() {
    console.log('\n📋 Checking existing tables...')

    // Check if protests table exists
    const tables = ['protests', 'routes', 'footfall_baseline', 'business_nodes']

    for (const table of tables) {
        const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=count&limit=0`, {
            method: 'GET',
            headers: {
                'apikey': serviceRoleKey,
                'Authorization': `Bearer ${serviceRoleKey}`,
                'Prefer': 'count=exact'
            }
        })

        if (response.ok) {
            const count = response.headers.get('content-range')
            console.log(`   ✅ ${table}: exists (${count || 'empty'})`)
        } else if (response.status === 404) {
            console.log(`   ❌ ${table}: not found - NEEDS MIGRATION`)
        } else {
            console.log(`   ⚠️ ${table}: ${response.status} ${response.statusText}`)
        }
    }
}

async function main() {
    console.log('═'.repeat(60))
    console.log(' Supabase Database Status Check')
    console.log('═'.repeat(60))
    console.log(`\nURL: ${supabaseUrl}`)
    console.log(`Key: ${serviceRoleKey.substring(0, 20)}...`)
    console.log()

    await testConnection()
    await checkPostGIS()
    await checkTables()

    console.log('\n' + '═'.repeat(60))
    console.log('\n📝 To run migrations, please:')
    console.log('   1. Go to: https://supabase.com/dashboard')
    console.log('   2. Open SQL Editor')
    console.log('   3. Paste contents of each migration file')
    console.log()
}

main().catch(console.error)
