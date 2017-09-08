#!/usr/bin/env bash
#*******************************************************************************
# Copyright (c) 2017 Red Hat, Inc and others
#
# All rights reserved. This program and the accompanying materials
# are made available under the terms of the Eclipse Public License v1.0
# which accompanies this distribution, and is available at
# http://www.eclipse.org/legal/epl-v10.html
#
# Contributors:
#     Red Hat, Inc. - initial API and implementation
#
#******************************************************************************

set -e

. common.sh

OPENSHIFT_PROJECT_NAME=${OPENSHIFT_PROJECT_NAME:=redhat-iot}

# print error and exit when necessary

die() { printf "$@" "\n" 1>&2 ; exit 1; }

### Remove imagestreams and buildconfigs

#$OC delete buildconfig dashboard
#$OC delete imagestream dashboard

$OC delete buildconfig dashboard-proxy
$OC delete imagestream dashboard-proxy

### Add local development as binary source buildconfig
#echo Creating new buildConfig for local source builds
#$OC new-build --name dashboard --image-stream nodejs:4 --strategy source --binary
#echo Starting new build using local source at ../dashboard
#$OC start-build dashboard --from-dir=../dashboard --follow

echo Creating new buildConfig for local source builds
$OC new-build --name dashboard-proxy --image-stream wildfly:10.1 --strategy source --binary
echo Starting new build using local source at ../dashboard-proxy
$OC start-build dashboard-proxy --from-dir=../dashboard-proxy --follow

### Optionally
# oc get pods
# figure out the name of the running pod for the dashboard
#
# then cd to the dashboard directory in your working dir
# oc rsync ../dashboard <pod>:/opt/app-root/src -w --no-perms=true
