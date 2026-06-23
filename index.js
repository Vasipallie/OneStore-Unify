import express from 'express';
import cookieParser from 'cookie-parser';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();
import { generate, count } from "random-words";
const __dirname = dirname(fileURLToPath(import.meta.url));
import { createClient } from '@supabase/supabase-js';
import bodyParser from 'body-parser';
import path from 'path';

import { XposedOrNot } from 'xposedornot';
const xon = new XposedOrNot();
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cookieParser());
const supabase = createClient(process.env.supaURL, process.env.supaKEY);
const crypto = await import('crypto');

function parseSessionCookie(sessionCookie) {
    if (!sessionCookie) {
        return null;
    }

    if (typeof sessionCookie === 'object') {
        return sessionCookie;
    }

    try {
        return JSON.parse(sessionCookie);
    } catch {
        return null;
    }
}

function storeSessionCookie(res, session) {
    if (!session?.access_token || !session?.refresh_token) {
        return;
    }

    res.cookie('session', JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
    }), {
        httpOnly: true,
        sameSite: 'lax',
    });
}

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'views')));
app.use(bodyParser.urlencoded({ extended: true }));

// Vital functions for generation and pass encryp-decrypt 
function passgen(num){
    return crypto.randomBytes(num).toString('hex');
}
function getfernet(keyphrase){
    const keyphrasee = Buffer.from(keyphrase, 'utf-8');
    const fernetkey = crypto.createHash('sha256').update(keyphrasee).digest();
    return fernetkey;
}
function ferncrypt(keyphrase, data){
    const fernetkey = getfernet(keyphrase);
    let ciphertext = crypto.createCipheriv('aes-256-cbc', fernetkey, Buffer.alloc(16, 0));
    let encrypted = ciphertext.update(data, 'utf-8', 'hex');
    encrypted += ciphertext.final('hex');
    return encrypted;
}
function fdrecrypt(keyphrase, encrypte){
    const fernkey = getfernet(keyphrase);
    const plain = crypto.createDecipheriv('aes-256-cbc', fernkey, Buffer.alloc(16, 0));
    let decrypted = plain.update(encrypte, 'hex', 'utf-8');
    decrypted += plain.final('utf-8');
    return decrypted;
}



app.route('/').get((req, res) => {
    res.render('index');
});
// Login
app.route('/login').get((req, res) => {
    const session = parseSessionCookie(req.cookies.session);
    const keyphrase = req.cookies.keyphrase;
    if (session){
        supabase.auth.setSession(session).then(({data,error}) =>{
            if (error){
                console.error('session error:', error);
                res.clearCookie('session');
                res.render('login', { error: 'Session expired. Please log in again.' });
            }else{
                if (keyphrase){
                    res.redirect('/dashboard');
                }else{
                    res.render('keyauth');
                }
            }
        })
    }
    else{
        res.render('login');
    }

});
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const {data, error} = await supabase.auth.signInWithPassword({email, password});
    if (error){
        console.error('login error:', error);
        res.status(401).render('login', { error: 'Invalid email or password' });
    }else{
        storeSessionCookie(res, data.session);
        res.redirect('/keyauth');
    }
});
app.route('/dashboard').get((req, res) =>{
    const session = parseSessionCookie(req.cookies.session);
    const keyphrase = req.cookies.keyphrase;
    if (!keyphrase){
        return res.redirect('/keyauth');
    }
    if (session){
        supabase.auth.setSession(session).then(({data,error}) =>{
            if (error){
                console.error('session error:', error);
                res.clearCookie('session');
                res.render('login', { error: 'Session expired. Please log in again.' });
            }
            else{
                supabase.from('Databayse').select('*').eq('useruid', data.user.id).single().then(({data: userData, error: dbError}) => {
                if (dbError){
                    console.error('database error:', dbError);
                    res.status(500).render('dashboard', { error: 'Error loading user data. Please try again later.' });
                }
                else{
                    const nickname = userData.nick;
                    const passwordsencrypted = userData.passwords;
                    const passwordsdecrypted = fdrecrypt(keyphrase, passwordsencrypted);
                    let passwords = {};

                    try {
                        passwords = JSON.parse(passwordsdecrypted);
                    } catch (parseError) {
                        console.error('password parse error:', parseError);
                    }

                    res.render('dashboard', { nickname, passwords });
                }
                });
            }
        })
    }
    else{
        res.render('login', { error: 'Please log in to access the dashboard.' });
    }
});

async function verifyKeyAuth(req, res) {
    const { key1entry, key2entry, key3entry, key4entry, key5entry, key6entry, key1, key2, key3, key4, key5, key6 } = req.body;
    const keyphraseentry = [
        key1entry ?? key1 ?? '',
        key2entry ?? key2 ?? '',
        key3entry ?? key3 ?? '',
        key4entry ?? key4 ?? '',
        key5entry ?? key5 ?? '',
        key6entry ?? key6 ?? '',
    ].join('').toLowerCase();
    const session = parseSessionCookie(req.cookies.session);

    if (!session){
        return res.status(400).render('login', { error: 'Please log in first.' });
    }

    const sessionResult = await supabase.auth.setSession(session);
    if (sessionResult.error){
        console.error('session error:', sessionResult.error);
        res.clearCookie('session');
        return res.render('login', { error: 'Session expired. Please log in again.' });
    }

    const useruid = sessionResult.data.user.id;
    const { data, error } = await supabase.from('Databayse').select('*').eq('useruid', useruid).single();
    if (error || !data){
        console.error('database error:', error);
        return res.status(500).render('keyauth', { error: 'Error loading key data. Please try again later.' });
    }

    const hash = crypto.createHash('sha256').update(keyphraseentry + data.salt).digest('hex');
    if (hash !== data.hash){
        return res.status(401).render('keyauth', { error: 'Invalid keyphrases. Please try again.' });
    }

    res.cookie('keyphrase', keyphraseentry, { httpOnly: true });
    return res.redirect('/dashboard');
}
// Signup
app.route('/create').get((req, res) =>{
    res.render('signup');
});
app.post('/create', async (req, res) =>{
    const { email, password , nickname } = req.body;
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error){
        console.error('signup error:', error);
        res.status(400).render('signup', { error: 'Error creating account. Please try again.' });
    }else{
    const salt = passgen(16);
    const key1 = generate({minLength:6});
    const key2 = generate({minLength:6});
    const key3 = generate({minLength:6});
    const key4 = generate({minLength:6});
    const key5 = generate({minLength:6});
    const key6 = generate({minLength:6});
    const keyphrase = [key1, key2, key3, key4, key5, key6].join('').toLowerCase();
    const hash = crypto.createHash('sha256').update(keyphrase + salt).digest('hex');
    const useruid = data.user.id;
    const crypass = ferncrypt(keyphrase, '{}');
    const { data: insertData, error: insertError } = await supabase.from('Databayse').insert({ hash: hash, useruid: useruid, salt: salt, passwords: crypass, nick: nickname});
    if (insertError){
        console.error('database error:', insertError);
        useruid = data.user.id;
        supabase.auth.admin.deleteUser(useruid).then(({error: delError}) =>{
            if (delError){
                console.error('cleanup error:', delError);
            }
        });
        res.status(500).render('signup', { error: 'Error saving user data. Please try again later.' });
    }else{
        res.cookie('session', data.session, { httpOnly: true });
        res.cookie('keyphrase', keyphrase, { httpOnly: true });
        res.render('keydisp', { key1, key2, key3, key4, key5, key6 });
    }
}});
app.route('/keyauth').get((req, res) =>{
    res.render('keyauth');
});
app.post('/keyauth', verifyKeyAuth);
app.post('/keyverify', verifyKeyAuth);
app.route('/logout').get((req, res) =>{
    res.clearCookie('session');
    res.clearCookie('keyphrase');
    res.render('logout');
});
app.post('/keysignupverify', (req, res) =>{
    const { key1entry, key2entry, key3entry, key4entry, key5entry, key6entry, key1, key2, key3, key4, key5, key6 } = req.body;
    const storedKeyphrase = req.cookies.keyphrase;
    if (!storedKeyphrase) {
        return res.render('keydisp', { error: 'Session expired. Please sign up again.', key1, key2, key3, key4, key5, key6 });
    }

    const keyphraseentry = [key1entry, key2entry, key3entry, key4entry, key5entry, key6entry].join('').toLowerCase();
    if (storedKeyphrase === keyphraseentry){
        return res.redirect('/dashboard');
    }

    return res.render('keydisp', { notification: 'Invalid keyphrases. Please try again.', key1, key2, key3, key4, key5, key6 });
});
app.route('/passwords').get(async (req, res) =>{
    const session = parseSessionCookie(req.cookies.session);
    const keyphrase = req.cookies.keyphrase;
    if (!session || !keyphrase){
        return res.redirect('/login');
    }

    const sessionResult = await supabase.auth.setSession(session);
    if (sessionResult.error){
        console.error('session error:', sessionResult.error);
        res.clearCookie('session');
        res.clearCookie('keyphrase');
        return res.render('login', { error: 'Session expired. Please log in again.' });
    }

    const useruid = sessionResult.data.user.id;
    const { data: userData, error: dbError } = await supabase.from('Databayse').select('*').eq('useruid', useruid).single();
    if (dbError || !userData){
        console.error('database error:', dbError);
        return res.status(500).render('dashboard', { error: 'Error loading password vault. Please try again later.' });
    }

    let passwords = {};
    try {
        const decrypted = fdrecrypt(keyphrase, userData.passwords || '{}');
        passwords = JSON.parse(decrypted || '{}');
    } catch (parseError){
        console.error('password parse error:', parseError);
    }

    return res.render('passwords', { nickname: userData.nick, passwords });
});
app.post('/passwords', async (req, res) =>{
    const session = parseSessionCookie(req.cookies.session);
    const keyphrase = req.cookies.keyphrase;
    if (!session || !keyphrase){
        return res.redirect('/login');
    }

    const { website, username, password } = req.body;
    if (!website || !username || !password){
        return res.status(400).render('passwords', { error: 'Website, username, and password are required.', passwords: {} });
    }

    const sessionResult = await supabase.auth.setSession(session);
    if (sessionResult.error){
        console.error('session error:', sessionResult.error);
        res.clearCookie('session');
        res.clearCookie('keyphrase');
        return res.render('login', { error: 'Session expired. Please log in again.' });
    }

    const useruid = sessionResult.data.user.id;
    const { data: userData, error: dbError } = await supabase.from('Databayse').select('*').eq('useruid', useruid).single();
    if (dbError || !userData){
        console.error('database error:', dbError);
        return res.status(500).render('passwords', { error: 'Error loading password vault. Please try again later.', passwords: {} });
    }

    let passwords = {};
    try {
        const decrypted = fdrecrypt(keyphrase, userData.passwords || '{}');
        passwords = JSON.parse(decrypted || '{}');
    } catch (parseError){
        console.error('password parse error:', parseError);
        passwords = {};
    }

    const nextIndex = Object.keys(passwords).length;
    passwords[nextIndex] = { website, username, password };

    const encryptedPasswords = ferncrypt(keyphrase, JSON.stringify(passwords));
    const { error: updateError } = await supabase.from('Databayse').update({ passwords: encryptedPasswords }).eq('useruid', useruid);
    if (updateError){
        console.error('password update error:', updateError);
        return res.status(500).render('passwords', { error: 'Error saving password. Please try again later.', nickname: userData.nick, passwords });
    }

    return res.redirect('/passwords');
});
// Password generator routes
app.route('/password-gen').get((req, res) =>{
    const session = parseSessionCookie(req.cookies.session);
    if (!session){
        return res.redirect('/login');
    }
    res.render('password-gen', { generated: null });
});

app.post('/password-gen', (req, res) =>{
    const session = parseSessionCookie(req.cookies.session);
    if (!session){
        return res.redirect('/login');
    }
    const length = parseInt(req.body.length, 10) || 32;
    // passgen accepts number of bytes; hex length = bytes*2
    const bytes = Math.ceil(length / 2);
    let generated = passgen(bytes);
    generated = generated.slice(0, length);
    res.render('password-gen', { generated });
});
app.route('/breach').get((req, res) =>{
    res.render('breach');
});
app.post('/breach', async (req, res) =>{
    const {email} = req.body;
    const result = await xon.checkEmail(email);

    res.render('breach-result', { email, result });
    
    if (result.found) {
    console.log(`Email found in ${result.breaches.length} breaches:`);
    result.breaches.forEach(breach => console.log(`  - ${breach}`));
    } else {
    console.log('Good news! Email not found in any known breaches.');
    }
});
/*
THIS IS THE 404 ROUTE
>>>DO NOT ADD ANYTHING BEYOND THIS<<<
*/
app.route('/:id').get((req, res) => {
    res.status(404).render('404');
});
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT}`);
});