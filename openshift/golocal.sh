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

# Grab the JDBC driver
TMPFILE1=`mktemp`
TMPFILE2=`mktemp -d`
DFILE="2.5.38.1058 GA/Cloudera_ImpalaJDBC4_2.5.38.zip"
URL="https://downloads.cloudera.com/connectors/impala_jdbc_2.5.38.1058.zip"

echo "Downloading JDBC Driver from ${URL}"...
curl -sko "${TMPFILE1}" "${URL}"
echo "Extracting JDBC Driver..."
unzip -q -d "${TMPFILE2}" "${TMPFILE1}" "${DFILE}"
unzip -q -o -d ../dashboard-proxy/modules/org/apache/hadoop/impala/main \
    "${TMPFILE2}/${DFILE}" "*.jar"
rm -f "${TMPFILE1}"
rm -rf "${TMPFILE2}"

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
